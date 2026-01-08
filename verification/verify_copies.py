from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to app
        page.goto("http://localhost:3000")

        # Wait for potential load
        page.wait_for_timeout(2000)

        if page.get_by_role("button", name="ACCESO ALUMNOS").is_visible():
             page.get_by_role("button", name="ACCESO ALUMNOS").click()
             page.wait_for_timeout(500)

        # Login
        page.get_by_placeholder("juan.garcia").fill("test.student")
        page.get_by_role("button", name="Entrar").click()

        # Wait for book list
        page.wait_for_selector("text=Book with Copies")

        # Click "Ver Detalles" on the book
        page.get_by_role("button", name="Ver Detalles").first.click()

        # Wait for modal content
        page.wait_for_selector("text=Ejemplares")

        # Verify text
        # It might be separate text nodes "3" "/" "5" or similar.
        # Let's verify text content of the element that contains Ejemplares
        # Or look for "3/5" more loosely.

        # Take screenshot of the modal
        page.screenshot(path="verification/verification.png")

        # Use more robust check
        expect(page.locator("text=3/5")).to_be_visible()

        browser.close()

if __name__ == "__main__":
    run()
