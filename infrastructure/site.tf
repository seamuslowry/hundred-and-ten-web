resource "azurerm_resource_group" "site" {
  name     = "hundred-and-ten-web"
  location = "eastus2"
}

resource "azurerm_static_web_app" "hundred_and_ten_web" {
  name                = "hundred-and-ten-web"
  resource_group_name = azurerm_resource_group.site.name
  location            = azurerm_resource_group.site.location
}
