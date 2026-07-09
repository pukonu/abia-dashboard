locals {
  connection_name  = "${var.name_prefix}-connection"
  destination_name = "${var.name_prefix}-destination"
  rule_name        = "${var.name_prefix}-friday"
  events_role      = "${var.name_prefix}-events-role"
}

# ---------------------------------------------------------------------------
# EventBridge connection — attaches Authorization: Bearer <CRON_SECRET>
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_event_connection" "digest" {
  name               = local.connection_name
  description        = "Auth for Abia weekly digest Amplify cron endpoint"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "Authorization"
      value = "Bearer ${var.cron_secret}"
    }
  }
}

# ---------------------------------------------------------------------------
# API Destination — HTTP target pointing at Amplify
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_event_api_destination" "digest" {
  name                             = local.destination_name
  description                      = "POST Abia Amplify /api/cron/weekly-digest"
  invocation_endpoint              = var.digest_url
  http_method                      = "POST"
  invocation_rate_limit_per_second = 1
  connection_arn                   = aws_cloudwatch_event_connection.digest.arn
}

# ---------------------------------------------------------------------------
# IAM role — EventBridge Rules may invoke the API Destination
# (EventBridge Scheduler cannot target API Destinations directly.)
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "events_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "events" {
  name               = local.events_role
  assume_role_policy = data.aws_iam_policy_document.events_assume.json
}

data "aws_iam_policy_document" "events_invoke" {
  statement {
    sid    = "InvokeApiDestination"
    effect = "Allow"
    actions = [
      "events:InvokeApiDestination",
    ]
    resources = [
      aws_cloudwatch_event_api_destination.digest.arn,
    ]
  }
}

resource "aws_iam_role_policy" "events_invoke" {
  name   = "${var.name_prefix}-invoke"
  role   = aws_iam_role.events.id
  policy = data.aws_iam_policy_document.events_invoke.json
}

# ---------------------------------------------------------------------------
# EventBridge rule — every Friday (cron is always UTC)
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_event_rule" "weekly_digest" {
  name                = local.rule_name
  description         = "Fire Abia weekly digest email every Friday"
  schedule_expression = var.schedule_expression
  state               = var.enabled ? "ENABLED" : "DISABLED"
}

resource "aws_cloudwatch_event_target" "digest" {
  rule      = aws_cloudwatch_event_rule.weekly_digest.name
  target_id = "amplify-weekly-digest"
  arn       = aws_cloudwatch_event_api_destination.digest.arn
  role_arn  = aws_iam_role.events.arn

  # Empty JSON body is fine — the route accepts POST with no body.
  input = jsonencode({})

  retry_policy {
    maximum_event_age_in_seconds = 3600
    maximum_retry_attempts       = var.max_retry_attempts
  }
}
