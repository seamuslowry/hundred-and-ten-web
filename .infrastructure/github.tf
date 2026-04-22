data "azurerm_client_config" "current" {}

resource "azurerm_user_assigned_identity" "github_deploy" {
  name                = "hundredandtenweb-github-deploy"
  resource_group_name = azurerm_resource_group.web.name
  location            = azurerm_resource_group.web.location
}

resource "azurerm_federated_identity_credential" "github_actions_main" {
  name      = "github-actions-main"
  user_assigned_identity_id = azurerm_user_assigned_identity.github_deploy.id
  audience  = ["api://AzureADTokenExchange"]
  issuer    = "https://token.actions.githubusercontent.com"

  subject = "repo:seamuslowry/hundred-and-ten-web:ref:refs/heads/main"
}

resource "azurerm_role_assignment" "github_deploy" {
  # Scoped to the site app. The deploy action needs Contributor on the app.
  scope                = azurerm_static_web_app.hundredandten_web.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.github_deploy.principal_id
}

resource "github_actions_variable" "azure_client_id" {
  repository    = "hundred-and-ten-web"
  variable_name = "AZURE_CLIENT_ID"
  value         = azurerm_user_assigned_identity.github_deploy.client_id
}

resource "github_actions_variable" "azure_tenant_id" {
  repository    = "hundred-and-ten-web"
  variable_name = "AZURE_TENANT_ID"
  value         = data.azurerm_client_config.current.tenant_id
}

resource "github_actions_variable" "azure_subscription_id" {
  repository    = "hundred-and-ten-web"
  variable_name = "AZURE_SUBSCRIPTION_ID"
  value         = data.azurerm_client_config.current.subscription_id
}
