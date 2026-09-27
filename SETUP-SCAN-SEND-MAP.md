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
