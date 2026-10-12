# Scan & Send + Shipping Map — setup

## 1. Upload the files
Upload everything in this zip to the **Shipping-Portal** repo, keeping the folders
(`app/`, `components/`, `lib/`, `types/`, `supabase/`, plus `package.json`).

## 2. Run the database update
Supabase → SQL Editor → paste all of `supabase/scan_send_map.sql` → Run.
This adds the photo columns and creates the `package-photos` storage bucket.

That's all you need. Scan & Send and the map work after this.

## 3. Optional: "Email instead" button
Only if you also want to email the photo to some customers:
1. Create a free account at resend.com.
2. Domains → Add `erendirasboutique.com` → add the DNS records it shows you in Cloudflare
   (DNS only / gray cloud). Wait for "Verified".
3. API Keys → Create → copy it.
4. Vercel → Shipping-Portal → Settings → Environment Variables:
   - `RESEND_API_KEY` = the key
   - `EMAIL_FROM` = `Erendira's Boutique <envios@erendirasboutique.com>`
5. Redeploy. The "Email instead" button appears for customers who have an email on file.

## How it works
- **Scan & Send** (in the menu, or `ship.erendirasboutique.com/scan` on a phone):
  1. Scan the label (or type the tracking / EB number).
  2. Take a photo of the package.
  3. Tap **Share to Messenger** → pick Messenger or Business Suite → pick the customer's chat → send.
     The photo and message with the tracking link are attached. The message is also copied,
     so paste it if Messenger drops it.
  4. The order saves the photo and is marked as sent, so it warns you if it's scanned again.
- **Shipping Map** is on the Dashboard and in the menu.

---

# Messenger links + auto-send

## 1. Database (required)
Supabase → SQL Editor → run `supabase/messenger_link.sql`.

After this, every customer gets a **Messenger** link:
- **Create Label:** picking a customer without one shows "needs their Facebook linked" with a box to paste it.
- **Customers:** open a customer → **Messenger** section.
- **Scan & Send:** if they're linked, **Open [name]'s chat** copies the photo and opens their chat directly.
  If not, the same warning and box show up there too.

Any Facebook profile link (facebook.com/name or profile.php?id=…), m.me link, messenger.com chat link,
or Business Suite chat link works.

## 2. Auto-send (optional, needs Facebook approval)
Auto-send only works for customers who **messaged your business Page in the last 24 hours**.
Facebook doesn't allow it otherwise. Everyone else uses the one-tap chat.

1. developers.facebook.com → Create app → type **Business** → add the **Messenger** product.
2. Messenger → Settings → **Generate access token** for your Page. Copy it.
3. App settings → Basic → copy the **App secret**.
4. Vercel → Shipping-Portal → Environment Variables:
   - `FB_PAGE_ACCESS_TOKEN` = the Page token
   - `FB_APP_SECRET` = the app secret
   - `FB_VERIFY_TOKEN` = any made-up password, e.g. `eb-messenger-2026`
   Then redeploy.
5. Messenger → Settings → Webhooks → **Add callback URL**:
   - URL: `https://ship.erendirasboutique.com/api/messenger/webhook`
   - Verify token: the same `FB_VERIFY_TOKEN`
   Subscribe your Page to **messages**, **messaging_postbacks** and **message_reactions**.
6. App Review → request **pages_messaging** (Advanced Access). Until it's approved, auto-send only
   reaches people with a role on the app.

How linking works: when someone messages the Page, the portal saves them. If exactly one customer has
the exact same name, they're linked on their own. Otherwise open the customer (or the Create Label
warning) and tap their name under "Messaged your Page?".

On Scan & Send, a linked customer who messaged the Page in the last 24 hours shows a green
"sends by itself" box. After the photo, it counts down 3 seconds (tap **Cancel** to stop), then sends
the photo and tracking message from your Page. If Facebook refuses, it falls back to the chat button.
