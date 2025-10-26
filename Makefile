.PHONY: deps-cloudflare tunnel-up tunnel-bg tunnel-down caddy-up caddy-bg caddy-down

deps-cloudflare:
	./scripts/mac/install_cloudflared.sh

tunnel-up:
	./scripts/mac/tunnel_up.sh

tunnel-bg:
	./scripts/mac/tunnel_bg.sh

tunnel-down:
	./scripts/mac/tunnel_down.sh

caddy-up:
	docker compose up -d caddy

caddy-bg: caddy-up

caddy-down:
	docker compose rm -sf caddy
