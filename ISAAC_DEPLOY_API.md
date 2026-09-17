# Isaac deployment API

This repository is wired to one Coolify application and one hostname:

- Repository: `BadAnt82/Isaac-Demo`, branch `master`
- Live URL: <https://isaac.badantproductions.com>
- Coolify application UUID: `afcmgbwczypcqtxcugqpein8`

## Authentication

Create a separate Coolify API token in **Keys & Tokens → API Tokens** and
grant it **deploy** permission only. Give that token a name such as
`isaac-deploy`. Do not use the infrastructure administrator token or put a
token in source control. Coolify displays the token secret once; store it in
Isaac's secret store as `ISAAC_DEPLOY_TOKEN`.

## Deploy

After committing and pushing changes to `BadAnt82/Isaac-Demo:master`, run:

```powershell
$env:ISAAC_DEPLOY_TOKEN = "<the deploy-only token>"
node scripts/deploy-isaac.mjs
```

The helper calls this fixed endpoint:

```text
POST http://65.108.216.96:8000/api/v1/deploy?uuid=afcmgbwczypcqtxcugqpein8&force=false
Authorization: Bearer <ISAAC_DEPLOY_TOKEN>
```

The UUID is compiled into the helper. It accepts no target URL or resource
override, so it cannot request a deployment for Games or any other hostname.
The token's deploy permission prevents configuration, source, DNS, and other
resource changes.

## Local repository workflow

```powershell
git clone https://github.com/BadAnt82/Isaac-Demo.git
cd Isaac-Demo
# edit and test
git add .
git commit -m "Describe the change"
git push origin master
node scripts/deploy-isaac.mjs
```
