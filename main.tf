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

data "aws_iam_policy_document" "assume_lambda_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    effect = "Allow"
  }
}

resource "aws_iam_role" "gigantti_execution_role" {
  name = "gigantti-gpu-alert-execution-role"

  assume_role_policy = data.aws_iam_policy_document.assume_lambda_role.json

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

resource "aws_dynamodb_table" "gigantti" {
  name      = "gigantti"
  hash_key  = "sku"
  range_key = "ts"

  billing_mode = "PAY_PER_REQUEST"

  attribute {
    name = "sku"
    type = "S"
  }

  attribute {
    name = "ts"
    type = "S"
  }

  ttl {
    enabled        = true
    attribute_name = "ttl"
  }

  tags = {
    "Project" = "gigantti-gpu-alert"
  }
}

data "aws_iam_policy_document" "gigantti_use_dynamodb" {
  statement {
    actions   = ["dynamodb:Query", "dynamodb:PutItem"]
    resources = [aws_dynamodb_table.gigantti.arn]
    effect    = "Allow"
  }
}

resource "aws_iam_policy" "gigantti_use_dynamodb" {
  name   = "gigantti-gpu-alert-use-dynamodb"
  policy = data.aws_iam_policy_document.gigantti_use_dynamodb.json
  tags = {
    "Project" = "gigantti-gpu-alert"
  }
}

resource "aws_iam_role_policy_attachment" "gigantti_use_dynamodb" {
  role       = aws_iam_role.gigantti_execution_role.name
  policy_arn = aws_iam_policy.gigantti_use_dynamodb.arn
}

resource "aws_lambda_function" "gigantti_fn" {
  function_name = local.lambda_function_name

  filename         = local.lambda_function_package_path
  source_code_hash = filebase64sha256(local.lambda_function_package_path)

  role        = aws_iam_role.gigantti_execution_role.arn
  runtime     = "nodejs14.x"
  handler     = "index.handler"
  memory_size = 256
  timeout     = 10

  environment {
    variables = {
      "GIGANTTI_URL"      = "https://www.gigantti.fi/INTERSHOP/web/WFS/store-gigantti-Site/fi_FI/-/EUR/ViewStandardCatalog-Browse?CategoryName=fi-tietokonekomponentit-naytonohjaimet&CategoryDomainName=store-gigantti-ProductCatalog&SearchParameter=%26%40QueryTerm%3D*%26ContextCategoryUUID%3DYlOsGQV5I1EAAAFa8VOVoDxg%26discontinued%3D0%26online%3D1&SortingAttribute=ACTdate-desc&select-sort-refine=ACTdate-desc"
      "SLACK_WEBHOOK_URL" = var.slack_webhook_url
      "IGNORED_SKUS"      = "109531,169378,169752,178113,182015,182105,220365,220366,22584,304613,305976,71335,79922,315954,206667,299362,299363"
      "DYNAMODB_TABLE_ID" = aws_dynamodb_table.gigantti.id
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
  schedule_expression = "rate(1 minute)"

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
