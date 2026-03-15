### 2026-03-15: Shared ACA environment for UAT + prod
**By:** Marathe

**Decision:** Keep `infra/main.bicep` as a single per-environment deployment template, but treat Container Apps Environment infrastructure as shared for non-dev environments:
- `dev` keeps its own CAE/log workspace
- `uat` and `prod` default to the shared names `playgrid-shared-cae` and `playgrid-shared-logs`
- `deploy-infra.yml` accepts optional `container_app_env_resource_id` so the second environment can explicitly target the first environment's CAE when resource groups differ

**Why:**
- Preserves the existing manual `workflow_dispatch` deployment shape
- Gives UAT/prod deterministic shared resource names so repeated deployments converge on the same CAE definition
- Avoids CAE drift by also sharing the attached Log Analytics workspace instead of letting UAT/prod point the same CAE at different workspaces
- Keeps dev isolated for low-risk testing and experimentation
