FROM nginx:1.28-alpine
COPY runner.conf.template /etc/nginx/templates/default.conf.template
COPY frame.html.template /etc/nginx/templates/frame.html.template
COPY frame.mjs /srv/runner/frame.mjs
COPY runtime/ /srv/runner/dist/compiler/wwwroot/
