
from playwright.sync_api import Page, expect, sync_playwright
import time

def test_admin_features(page: Page):
    # 1. Arrange: Go to localhost
    print("Navigating to home...")
    page.goto("http://localhost:3001")

    # Wait for loading to finish (if any)
    page.wait_for_selector("text=ACCESO PROFESORES", timeout=10000)

    # 2. Login as SuperAdmin
    print("Logging in...")
    page.click("text=ACCESO PROFESORES")

    # Click Manual Login if present
    if page.is_visible("text=Usar Contraseña Manual"):
        page.click("text=Usar Contraseña Manual")

    page.fill("input[placeholder='Usuario']", "superadmin")
    page.fill("input[placeholder='••••••••']", "admin123")
    page.click("text=Entrar")

    # 3. Wait for Admin Dashboard
    print("Waiting for dashboard...")
    expect(page.get_by_text("Panel de Administración")).to_be_visible()

    # 4. Navigate to History Tab
    print("Navigating to History...")
    page.click("text=Historial")

    # 5. Verify UI Elements
    print("Verifying new features...")

    # Check for Global/Mi Clase toggle (since superadmin is technical)
    expect(page.get_by_role("button", name="Global")).to_be_visible()
    expect(page.get_by_role("button", name="Mi Clase")).to_be_visible()

    # Check for Search Bar
    search_input = page.get_by_placeholder("Buscar por libro o alumno...")
    expect(search_input).to_be_visible()

    # 6. Test Interaction (Search)
    search_input.fill("nonexistentbook12345")
    # Table should show empty or filtered
    # (Not strictly asserting table content here, just UI existence and screenshot)

    # 7. Screenshot
    print("Taking screenshot...")
    page.screenshot(path="/home/jules/verification/admin_history_features.png")

    # 8. Check Stats Tab for Toggle too
    print("Navigating to Stats...")
    page.click("text=Estadísticas")
    expect(page.get_by_role("button", name="Global")).to_be_visible()

    print("Done!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_admin_features(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
            raise e
        finally:
            browser.close()
