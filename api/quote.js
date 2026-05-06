// ═══════════════════════════════════════════════════════════════════════
// /api/quote.js
// 
// Vercel Serverless Function — handles "Get a Quote" form submissions
// for WSM Specialty Gases. Sends email via Resend API.
//
// Flow:
//   1. Receives POST request from index.html form
//   2. Validates required fields
//   3. Sends formatted email to sales@wsmsupplier.com via Resend
//   4. Returns JSON response to frontend
// ═══════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // ───────────────────────────────────────────────────────
  // 1. CORS headers (allow form to call this endpoint)
  // ───────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ───────────────────────────────────────────────────────
  // 2. Only allow POST requests
  // ───────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    });
  }

  // ───────────────────────────────────────────────────────
  // 3. Validate environment variable
  // ───────────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error. Please contact support.'
    });
  }

  // ───────────────────────────────────────────────────────
  // 4. Extract and validate form data
  // ───────────────────────────────────────────────────────
  const { company, email, phone, product } = req.body || {};

  if (!company || !email || !product) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: company, email, and product are required.'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email format.'
    });
  }

  const sanitize = (str) => String(str || '').replace(/[<>]/g, '').slice(0, 500);
  const cleanCompany = sanitize(company);
  const cleanEmail = sanitize(email);
  const cleanPhone = sanitize(phone);
  const cleanProduct = sanitize(product);

  // ───────────────────────────────────────────────────────
  // 5. Build email content
  // ───────────────────────────────────────────────────────
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#001f45;color:white;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="margin:0;font-size:20px">New Quote Request - WSM Specialty Gases</h2>
    <p style="margin:8px 0 0;font-size:13px;opacity:0.9">Received: ${timestamp} EST</p>
  </div>
  <div style="background:#f8f9fa;padding:24px;border:1px solid #e0e4e8;border-top:none;border-radius:0 0 8px 8px">
    <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e0e4e8">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px">Company</div>
      <div style="font-size:15px;color:#1a1a1a;font-weight:500">${cleanCompany}</div>
    </div>
    <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e0e4e8">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px">Email</div>
      <div style="font-size:15px"><a href="mailto:${cleanEmail}" style="color:#0056b8;text-decoration:none">${cleanEmail}</a></div>
    </div>
    ${cleanPhone ? `
    <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e0e4e8">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px">Phone / WhatsApp</div>
      <div style="font-size:15px"><a href="tel:${cleanPhone}" style="color:#0056b8;text-decoration:none">${cleanPhone}</a></div>
    </div>` : ''}
    <div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px">Product Needed</div>
      <div style="font-size:15px;color:#1a1a1a;font-weight:500">${cleanProduct}</div>
    </div>
  </div>
  <div style="margin-top:20px;padding:16px;background:#fff8e1;border-left:4px solid #c8d200;border-radius:4px;font-size:13px;color:#4a5568">
    <strong>Response target:</strong> within 24 hours.<br>
    <strong>Reply directly to lead:</strong> <a href="mailto:${cleanEmail}">${cleanEmail}</a>
  </div>
</body>
</html>`;

  const emailText = `NEW QUOTE REQUEST - WSM Specialty Gases
Received: ${timestamp} EST

Company:  ${cleanCompany}
Email:    ${cleanEmail}
Phone:    ${cleanPhone || '(not provided)'}
Product:  ${cleanProduct}

---
Reply directly to ${cleanEmail} to follow up.
Response target: within 24 hours.`;

  // ───────────────────────────────────────────────────────
  // 6. Send email via Resend API
  // ───────────────────────────────────────────────────────
  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'WSM Quote Request <noreply@wsmspecialtygases.com>',
        to: ['sales@wsmsupplier.com'],
        reply_to: cleanEmail,
        subject: `New Quote Request from ${cleanCompany}`,
        html: emailHtml,
        text: emailText
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData);
      return res.status(502).json({
        success: false,
        error: 'Failed to send email. Please try again or call (305) 455-1220.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Quote request sent successfully. We will respond within 24 hours.',
      emailId: resendData.id
    });

  } catch (error) {
    console.error('Quote handler error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again or call (305) 455-1220.'
    });
  }
}
