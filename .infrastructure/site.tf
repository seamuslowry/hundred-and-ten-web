resource "azurerm_resource_group" "web" {
  name     = "hundredandtenweb"
  location = "eastus2"
}

resource "azurerm_static_web_app" "hundredandten_web" {
  name                = "hundredandten-web"
  resource_group_name = azurerm_resource_group.web.name
  location            = azurerm_resource_group.web.location
}