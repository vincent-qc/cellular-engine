.PHONY: help install build build-sandbox build-all test lint format preflight clean release publish-engine publish-engine-dry-run run-npx create-alias

help:
	@echo "Makefile for cellular-api"
	@echo ""
	@echo "Usage:"
	@echo "  make install          - Install npm dependencies"
	@echo "  make build            - Build the entire project"
	@echo "  make build-sandbox    - Build the sandbox container"
	@echo "  make build-all        - Build the project and the sandbox"
	@echo "  make test             - Run the test suite"
	@echo "  make lint             - Lint the code"
	@echo "  make format           - Format the code"
	@echo "  make preflight        - Run formatting, linting, and tests"
	@echo "  make clean            - Remove generated files"
	@echo "  make release          - Publish a new release"
	@echo "  make publish-engine   - Publish @cellular-ai/engine package"
	@echo "  make publish-engine-dry-run - Dry run publish @cellular-ai/engine package"
	@echo "  make run-npx          - Run the API using npx (for testing the published package)"
	@echo "  make create-alias     - Create a 'gemini' alias for your shell"

install:
	npm install

build:
	npm run build

build-sandbox:
	npm run build:sandbox

build-all:
	npm run build:all

test:
	npm run test

lint:
	npm run lint

format:
	npm run format

preflight:
	npm run preflight

clean:
	npm run clean

release:
	npm run publish:release

publish-engine:
	cd packages/engine && npm run publish:patch

publish-engine-dry-run:
	cd packages/engine && npm run publish:dry-run

run-npx:
	npx https://github.com/vincent-qc/gemini-api

create-alias:
	scripts/create_alias.sh
