from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:3000")
        page.wait_for_timeout(3000)
        page.screenshot(path="verification/debug_login.png")
        print(page.content())
        browser.close()

if __name__ == "__main__":
    run()
