---
title: Train Your Own — Study Notes
summary: Everything the tinyeinstein build teaches, in order: autograd, MLPs, vectors, transformers, fine-tuning, and reward models.
type: reference
status: draft
owner: hackefeller
tags: [study, neural-nets, transformers, fine-tuning, reward-models, tool-calling]
related: [01-the-tool-call-is-not-the-plan.md, 03-what-your-eval-is-measuring.md]
updated: 2026-10-18
---

These notes cover the full `tinyeinstein` arc: five machines built from zero on a laptop, each one verified by tests you can re-run. Read them with the [slide deck](/soapbox/train-your-own/) open. Every claim below names the file that proves it.

## Part 1 — Autograd: the engine everything stands on

`tinyeinstein/engine.py` implements reverse-mode autodiff on scalars in about 100 lines. Each `Value` wraps one float, remembers the operation that made it, and carries a `_backward` closure with the local derivative. `backward()` walks the graph in reverse topological order applying the chain rule. Gradients accumulate with `+=` because shared parents receive gradient from every child — which is why every model here needs an explicit `zero_grad` before each step.

Run it: `python -m tinyeinstein.demo`. A 2-4-1 MLP learns four points from loss 6.37 to 0.02 in 400 steps, ending at predictions like −0.954 versus a −1 target. Tests: `tests/test_engine.py`.

The one idea to keep: PyTorch runs this same algorithm. Frameworks add vectorization and GPU kernels, not different math.

## Part 2 — Vectors: why the scalar engine cannot scale

The scalar engine spends one Python call per multiply. A 784-128-10 MLP needs roughly 100,000 scalar ops per image, so MNIST is hopeless at that speed. `tinyeinstein/vector.py` reimplements the identical MLP with batched NumPy: batches are rows, one matrix multiply replaces a whole layer of scalar ops, same gradients, roughly 1000x less overhead. Watch for the aliasing bug we actually caught here: `dlogits = probs` mutated the probabilities in place and zeroed every accuracy readout until it became `probs.copy()`.

`tinyeinstein/data.py` downloads MNIST once into `data/mnist/`. The smoke run (`train_mnist --subset 2000 --steps 300`) reaches 0.895 test accuracy; the full run passes 0.95. Docs: `docs/mnist.md`.

## Part 3 — The transformer: attention from scratch

`tinyeinstein/gpt.py` is a causal GPT in NumPy: token plus position embeddings, pre-norm transformer blocks, masked multi-head attention, a tanh MLP, residual connections, and a linear head with cross-entropy loss. Two details carry the architecture: the causal mask blocks future peeking (tested explicitly in `tests/test_gpt.py`), and every `out = skip + branch` adds the skip gradient back, which is what lets depth train at all.

Trained on Tiny Shakespeare with Adam (`train_gpt.py`, 800 steps), loss falls from about 3.9 to 3.3 and `sample_gpt.py` generates readable-ish text. Two more real bugs lived here: missing embedding gradients (every parameter must receive one — the test asserts exactly that) and sampling past the trained position table. Docs: `docs/transformer.md`.

## Part 4 — Fine-tuning: teaching tool calls, and the honest failure

`tinyeinstein/toolcalls.py` defines three toy tools with fixed JSON shapes; `train_toolcall.py` fine-tunes the GPT to emit them. Train/test split is by slot value — London and Lima never appear in training — so held-out scores measure learning, not memorization.

Result: rank accuracy on trained items climbs within 80 steps, but held-out items stay at coin-flip noise (0.6 to 0.4 on five items) and free generation stays gibberish. Exact character-level copying of unseen values from a 1,000-character corpus is too hard for 400 steps of a 2-layer model. This failure is the lesson: generation must recall every character from memory. Docs: `docs/toolcalls.md`.

## Part 5 — The reward model: judge, don't write

`tinyeinstein/rewards.py` changes the game: instead of generating answers, score candidates. Preference pairs (right call versus wrong tool, right call versus corrupted slot) train a linear judge with the Bradley-Terry loss, `−log sigmoid(chosen − rejected)`, and best-of-N ships the top scorer.

Verified numbers from `train_reward --steps 300`: pairwise accuracy 0.2 → 0.967 on train, 0.9 on held-out. On unseen London the judge ranks the correct call (−0.112) above wrong-tool (−0.178), truncated (−0.283), and wrong-city (−0.461) answers. Why it transfers: the overlap feature checks a relationship (does the answer reuse the prompt's words?) instead of a memorized string. That mechanism — comparisons as training signal, a judge, best-of-N over a dumb generator — is RLHF in miniature. Docs: `docs/reward-learning.md`.

## Commands reference

```bash
cd tinyeinstein && source .venv/bin/activate
python -m tinyeinstein.demo                                        # Part 1
python -m tinyeinstein.train_mnist --subset 2000 --steps 300      # Part 2
python -m tinyeinstein.train_gpt --steps 800 --batch 32           # Part 3
python -m tinyeinstein.train_toolcall --steps 400                  # Part 4
python -m tinyeinstein.train_reward --steps 300                    # Part 5
python -m pytest -q                                                # all 9 tests
```

## Exercises to finish grokking

1. Zero out the overlap feature in `rewards.py` and re-run. Held-out accuracy collapses while train survives — that gap is memorization versus understanding, measured.
2. Derive the `+=` in `Value.__mul__._backward` by hand for `c = a * b + a` with a=2, b=3, then check against `test_engine.py`.
3. Swap best-of-N for worst-of-N in `train_reward.py` and read what it ships. That horror show is an upside-down reward model.
4. Change the Shakespeare block size and predict what happens to memory (attention is quadratic in block length) before running.
