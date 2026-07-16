.PHONY: deploy

AMPLIFY_BRANCH ?= $(shell git branch --show-current)

deploy:
	@if [ -z "$$AMPLIFY_APP_ID" ]; then \
		echo "AMPLIFY_APP_ID is required. Example: AMPLIFY_APP_ID=d123example make deploy"; \
		exit 1; \
	fi
	aws amplify start-job \
		--app-id "$$AMPLIFY_APP_ID" \
		--branch-name "$(AMPLIFY_BRANCH)" \
		--job-type RELEASE
