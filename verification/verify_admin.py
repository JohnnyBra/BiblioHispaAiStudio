
from playwright.sync_api import sync_playwright

def verify_admin_back_button():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Navigating to login page...")
            page.goto("http://localhost:5173")
            page.wait_for_load_state("networkidle")

            # Login as Admin (superadmin / admin123)
            print("Logging in as Admin...")
            page.click("text=ACCESO PROFESORES")

            # Depending on state, it might show Google Login or Manual.
            # Code says: !isManualLogin -> Google Login.
            # I need to click "Usar Contraseña Manual"
            if page.locator("text=Usar Contraseña Manual").is_visible():
                page.click("text=Usar Contraseña Manual")

            page.fill("input[placeholder='Usuario']", "superadmin")
            page.fill("input[placeholder='••••••••']", "admin123")
            page.click("button:has-text('Entrar')")

            # Wait for Admin View
            try:
                page.wait_for_selector("text=Panel de Administración", timeout=5000)
                print("Logged in as Admin.")
            except:
                print("Failed to login as Admin (timeout).")
                page.screenshot(path="verification/admin_login_fail.png")
                return

            # Check for button
            admin_back_button = page.locator("a[href='https://prisma.bibliohispa.es/']")
            if admin_back_button.is_visible():
                print("SUCCESS: Back button found on Admin View.")
            else:
                print("FAILURE: Back button NOT found on Admin View.")

            page.screenshot(path="verification/admin_view.png")

        except Exception as e:
            print(f"Error during verification: {e}")
            page.screenshot(path="verification/error_admin.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_admin_back_button()
