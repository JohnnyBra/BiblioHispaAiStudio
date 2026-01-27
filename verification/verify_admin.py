
from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Go to Home
        print("Navigating to home...")
        page.goto("http://localhost:5173")
        page.wait_for_timeout(2000)

        # 2. Select Admin Mode
        print("Selecting Teacher Access...")
        page.get_by_text("ACCESO PROFESORES").click()

        # 3. Manual Login
        print("Selecting Manual Password...")
        page.get_by_text("Usar Contraseña Manual").click()

        # 4. Fill Credentials
        print("Logging in as SuperAdmin...")
        page.fill("input[placeholder='Usuario']", "superadmin")
        page.fill("input[placeholder='••••••••']", "admin123")
        page.click("button:has-text('Entrar')")

        # 5. Wait for Dashboard
        print("Waiting for Dashboard...")
        expect(page.get_by_text("Panel de Administración")).to_be_visible(timeout=10000)

        # 6. Click Teachers Tab
        print("Clicking Teachers tab...")
        page.get_by_role("button", name="Profesores").click()

        # 7. Verify Column Header
        print("Verifying Technical Role column...")
        expect(page.get_by_text("Rol Técnico")).to_be_visible()

        # 8. Screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification/admin_teachers_tab.png")

        browser.close()
        print("Verification Done!")

if __name__ == "__main__":
    run()
