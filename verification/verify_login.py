
from playwright.sync_api import sync_playwright

def verify_login_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Note: We need the dev server running for this to work.
            # If the dev server is not running, this will fail.
            # However, I cannot easily start the dev server in background and keep it running
            # across tool calls reliably in this environment without blocking.
            # But I can try to start it in background in the same command or assume it is running?
            # The prompt says "In the development environment, the Vite frontend runs on port 5173".
            # I will try to hit localhost:5173. If it fails, I cannot verify visually.

            page.goto("http://localhost:5173")
            page.wait_for_selector("text=ACCESO PROFESORES")
            page.click("text=ACCESO PROFESORES")

            # Check for the Google Login button (or at least the container)
            # Since I cannot see the actual Google iframe in headless/local without internet potentially,
            # or without valid client ID, I just want to see if the page loaded and didn"t crash.

            page.wait_for_timeout(2000) # Wait for UI to settle
            page.screenshot(path="verification/login_page.png")
            print("Screenshot taken")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_login_page()
