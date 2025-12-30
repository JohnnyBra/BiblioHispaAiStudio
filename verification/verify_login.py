from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to the app (assuming it's running on localhost:5173 or 3000 if served)
            # Since we ran 'node server.js' and it serves 'dist', we use 3000.
            page.goto("http://localhost:3000")

            # Wait for content to load
            expect(page.get_by_text("Conectando")).not_to_be_visible(timeout=10000)

            # Verify basic elements of the new login screen
            expect(page.get_by_text("ACCESO PROFESORES")).to_be_visible()

            # Take screenshot of the initial screen
            page.screenshot(path="verification/login_screen.png")
            print("Screenshot login_screen.png created.")

            # Click on 'ACCESO PROFESORES'
            page.get_by_text("ACCESO PROFESORES").click()

            # Verify Google Login Button (or simulate its presence) and Manual Login toggle
            expect(page.get_by_text("Usar Contraseña Manual")).to_be_visible()

            # Take screenshot of the teacher login options
            page.screenshot(path="verification/teacher_login_options.png")
            print("Screenshot teacher_login_options.png created.")

            # Click "Usar Contraseña Manual"
            page.get_by_text("Usar Contraseña Manual").click()

            # Verify the manual form inputs
            expect(page.get_by_placeholder("Usuario")).to_be_visible()

            # Take screenshot of manual form
            page.screenshot(path="verification/manual_login_form.png")
            print("Screenshot manual_login_form.png created.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
