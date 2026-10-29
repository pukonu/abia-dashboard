.PHONY: help deploy-setup deploy-ping deploy-check deploy redeploy deploy-rollback \
        deploy-status deploy-logs deploy-amplify

help: ## Show this help
	@echo "Abia Executive Dashboard — make targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# --- Server deploy (Ansible, deploy/ansible) ----------------------------------
# Target host, folder and domains live in deploy/ansible/.env; the production app
# env in deploy/ansible/.env.production. See deploy/ansible/README.md.

ANSIBLE_DIR := deploy/ansible
# ansible-core 2.16: the newest that still runs against the host's Python 3.6.
ANSIBLE_VENV := $(ANSIBLE_DIR)/.venv
ANSIBLE_PLAYBOOK := $(CURDIR)/$(ANSIBLE_VENV)/bin/ansible-playbook
DEPLOY_PYTHON ?= python3.12
DEPLOY_ARGS ?=
DEPLOY_ANSIBLE := cd $(ANSIBLE_DIR) && .venv/bin/ansible abia_dashboard -m shell -a

deploy-setup: ## Install the pinned Ansible (2.16) + ansible.posix into deploy/ansible/.venv
	$(DEPLOY_PYTHON) -m venv $(ANSIBLE_VENV)
	$(ANSIBLE_VENV)/bin/pip install --quiet 'ansible-core>=2.16,<2.17'
	cd $(ANSIBLE_DIR) && .venv/bin/ansible-galaxy collection install 'ansible.posix>=1.5' -p collections

deploy-ping: ## Check Ansible can reach the server in deploy/ansible/.env
	cd $(ANSIBLE_DIR) && .venv/bin/ansible abia_dashboard -m ping

deploy-check: ## Syntax-check the deploy playbooks
	cd $(ANSIBLE_DIR) && $(ANSIBLE_PLAYBOOK) --syntax-check site.yml redeploy.yml rollback.yml

deploy: ## Build the web image + PWA, ship them, switch, reload nginx
	cd $(ANSIBLE_DIR) && $(ANSIBLE_PLAYBOOK) site.yml $(DEPLOY_ARGS)

redeploy: ## Restart the current release with a fresh .env.production (no rebuild)
	cd $(ANSIBLE_DIR) && $(ANSIBLE_PLAYBOOK) redeploy.yml $(DEPLOY_ARGS)

deploy-rollback: ## Serve the previous release again (DEPLOY_ARGS="-e to=<release id>")
	cd $(ANSIBLE_DIR) && $(ANSIBLE_PLAYBOOK) rollback.yml $(DEPLOY_ARGS)

deploy-status: ## Show the server's container, served release and PWA build
	$(DEPLOY_ANSIBLE) 'cd {{ deploy_root }} && docker compose ps && cat .env && echo "pwa -> $$(readlink pwa/current)"'

deploy-logs: ## Show the last 100 lines of the web container's log
	$(DEPLOY_ANSIBLE) 'cd {{ deploy_root }} && docker compose logs --tail 100 web'

# --- Legacy: AWS Amplify (until DNS moves to the server) -----------------------

AMPLIFY_BRANCH ?= $(shell git branch --show-current)

deploy-amplify: ## Start an Amplify release job (AMPLIFY_APP_ID=d123example)
	@if [ -z "$$AMPLIFY_APP_ID" ]; then \
		echo "AMPLIFY_APP_ID is required. Example: AMPLIFY_APP_ID=d123example make deploy-amplify"; \
		exit 1; \
	fi
	aws amplify start-job \
		--app-id "$$AMPLIFY_APP_ID" \
		--branch-name "$(AMPLIFY_BRANCH)" \
		--job-type RELEASE
