FROM nginx:alpine

# Custom server: the built-in Railpack static server injects a CSP without
# 'wasm-unsafe-eval', which blocks Pagefind's WASM search worker. nginx lets
# us set the correct headers (see nginx.conf) plus cache control.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html

EXPOSE 80