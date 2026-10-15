import unittest
from shared_catalog import catalog_from_backend, load_backend_catalog


class SharedCatalogTest(unittest.TestCase):
    def data(self):
        def item(id, category, price):
            return dict(id=id, sku=id, nameRu=id, category=category, basePrice=price, available=True)
        return dict(machine={"id": "machine-test"}, currency="RUB",
                    currentFlavor=item("base", "ICE_CREAM", 5.25),
                    toppings=[item("topping", "TOPPING", 1)],
                    sprinkles=[item("sprinkle", "SPRINKLE", 2)])

    def test_exact_server_ids_prices_and_availability(self):
        data = self.data()
        data["toppings"][0]["available"] = False
        result = catalog_from_backend(data)
        self.assertEqual(result["products"][0]["price"], 5.25)
        self.assertEqual(result["toppings"][0]["id"], "topping")
        self.assertFalse(result["toppings"][0]["available"])
        self.assertEqual(result["additives"][0]["price"], 2)

    def test_invalid_prices_never_fall_back_to_demo(self):
        for value in (None, "5", True, -1, float("nan"), float("inf")):
            with self.subTest(value=value):
                data = self.data()
                data["currentFlavor"]["basePrice"] = value
                with self.assertRaises(ValueError):
                    catalog_from_backend(data)

    def test_missing_machine_does_not_request_backend(self):
        def unexpected(*args, **kwargs):
            self.fail("No backend request expected")
        with self.assertRaises(ValueError):
            load_backend_catalog("", unexpected)

    def test_backend_failure_propagates_without_demo_catalog(self):
        def failing(*args, **kwargs):
            raise OSError("unavailable")
        with self.assertRaises(OSError):
            load_backend_catalog("machine-test", failing)


if __name__ == "__main__":
    unittest.main()
