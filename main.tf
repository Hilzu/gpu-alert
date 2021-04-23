terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 3.37"
    }
  }

  required_version = ">= 0.15.0"
}

provider "aws" {
  profile = "hilzu"
  region  = "eu-north-1"
}

variable "slack_webhook_url" {
  type      = string
  sensitive = true
}

locals {
  lambda_function_package_path = "dist/lambda.zip"
  lambda_function_name         = "gigantti-gpu-alert"
}

resource "aws_iam_role" "gigantti_execution_role" {
  name = "gigantti-gpu-alert-execution-role"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF

  tags = {
    "Project" = "gigantti-gpu-alert"
  }
}

resource "aws_iam_role_policy_attachment" "basic_lambda_execution" {
  role       = aws_iam_role.gigantti_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "gigantti" {
  name              = "/aws/lambda/${local.lambda_function_name}"
  retention_in_days = 14

  tags = {
    "Project" = "gigantti-gpu-alert"
  }
}

resource "aws_lambda_function" "gigantti_fn" {
  function_name = local.lambda_function_name

  filename         = local.lambda_function_package_path
  source_code_hash = filebase64sha256(local.lambda_function_package_path)

  role    = aws_iam_role.gigantti_execution_role.arn
  runtime = "nodejs14.x"
  handler = "handler/handler.handler"
  timeout = 15

  environment {
    variables = {
      "GIGANTTI_URL"      = "https://www.gigantti.fi/INTERSHOP/web/WFS/store-gigantti-Site/fi_FI/-/EUR/ViewStandardCatalog-Browse?CategoryName=fi-tietokonekomponentit-naytonohjaimet&CategoryDomainName=store-gigantti-ProductCatalog&SearchParameter=%26%40QueryTerm%3D*%26ContextCategoryUUID%3DYlOsGQV5I1EAAAFa8VOVoDxg%26discontinued%3D0%26online%3D1&SortingAttribute=ACTdate-desc&select-sort-refine=ACTdate-desc"
      "SLACK_WEBHOOK_URL" = var.slack_webhook_url
      "IGNORED_SKUS"      = "220365,220366,182105,169378,169752,22584"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.basic_lambda_execution,
    aws_cloudwatch_log_group.gigantti,
  ]

  tags = {
    "Project" = "gigantti-gpu-alert"
  }
}

resource "aws_cloudwatch_event_rule" "gigantti_schedule" {
  name                = "gigantti-gpu-alert-schedule"
  schedule_expression = "rate(1 hour)"

  tags = {
    "Project" = "gigantti-gpu-alert"
  }
}

resource "aws_cloudwatch_event_target" "gigantti_fn" {
  rule = aws_cloudwatch_event_rule.gigantti_schedule.name
  arn  = aws_lambda_function.gigantti_fn.arn
}

resource "aws_lambda_permission" "with_events" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.gigantti_fn.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.gigantti_schedule.arn
}
