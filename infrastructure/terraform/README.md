# Weekly digest scheduler (Amplify + EventBridge)

Amplify does not honor `vercel.json` crons. This Terraform stack creates an
**EventBridge scheduled rule** that POSTs your Amplify digest endpoint every Friday.

> Note: EventBridge **Scheduler** cannot target API Destinations. This stack uses a
> classic EventBridge **rule** + API Destination instead.

## What it creates

| Resource | Purpose |
|----------|---------|
| EventBridge Connection | Sends `Authorization: Bearer <CRON_SECRET>` |
| API Destination | HTTP target → Amplify `/api/cron/weekly-digest` |
| IAM role | Lets EventBridge invoke the API Destination |
| EventBridge rule + target | `cron(0 7 ? * FRI *)` UTC (= 08:00 WAT) by default |

## Apply

```bash
cd webapp/infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# edit digest_url + cron_secret
terraform init
terraform plan
terraform apply
```

If a previous apply partially created Scheduler resources, run `terraform apply`
again after pulling this fix — Terraform will replace the broken Scheduler pieces
with the EventBridge rule.

Amplify env must include the same `CRON_SECRET`, plus `SENDGRID_API_KEY` and Supabase keys.

`terraform.tfvars` is gitignored (contains secrets). Commit `.tf` files and
`terraform.tfvars.example` only. After `terraform init`, commit `.terraform.lock.hcl`
so provider versions stay pinned for the team.

## Timezone

EventBridge rules use **UTC only**. Default `cron(0 7 ? * FRI *)` is Friday
**08:00 Africa/Lagos (WAT)**. Adjust the hour in `schedule_expression` if needed.

## Manual test

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR-AMPLIFY-DOMAIN/api/cron/weekly-digest"
```

## Estimated cost

For **one invocation per week**:

| Service | Typical cost |
|---------|----------------|
| EventBridge scheduled rules | Free tier / negligible → **~$0** |
| EventBridge API Destinations | Free tier (64K/month) → **~$0** |
| IAM | Free |
| Amplify request (digest run) | Small SSR/API compute once a week — usually **cents or less** |
| SendGrid | Depends on your SendGrid plan / email volume (not AWS) |

**Bottom line:** the AWS scheduling pieces alone are effectively **free** at this volume.
