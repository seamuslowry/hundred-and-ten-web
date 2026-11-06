resource "azurerm_resource_group" "web" {
  name     = "hundredandtenweb"
  location = "eastus2"
}

resource "azurerm_static_web_app" "hundredandten_web" {
  name                = "hundredandten-web"
  resource_group_name = azurerm_resource_group.web.name
  location            = azurerm_resource_group.web.location
}
# PR preview hostname is <prefix>-<PR#>.<location>.<rest of default host>
# https://learn.microsoft.com/azure/static-web-apps/preview-environments
locals {
  swa_host_parts = split(".", azurerm_static_web_app.hundredandten_web.default_host_name)
}

resource "github_actions_variable" "swa_preview_host_prefix" {
  repository    = "hundred-and-ten-web"
  variable_name = "SWA_PREVIEW_HOST_PREFIX"
  value         = local.swa_host_parts[0]
}

resource "github_actions_variable" "swa_preview_host_suffix" {
  repository    = "hundred-and-ten-web"
  variable_name = "SWA_PREVIEW_HOST_SUFFIX"
  value         = join(".", concat([azurerm_resource_group.web.location], slice(local.swa_host_parts, 1, length(local.swa_host_parts))))
}
