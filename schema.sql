-- Run once in a new Cloudflare D1 database. Never put live inquiries or secrets in Git.
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
  notes TEXT NOT NULL DEFAULT '', created TEXT NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'not_configured'
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '', strategy TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1, position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY, mime TEXT NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT, description TEXT NOT NULL, created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(expires);
CREATE INDEX IF NOT EXISTS cases_public ON cases(published, position, id);
CREATE INDEX IF NOT EXISTS leads_status ON leads(status);
INSERT OR IGNORE INTO settings VALUES
('home_title','We don''t just drive traffic'),
('home_highlight','—we engineer growth.'),
('home_description','Strategic Meta Ads, high-intent Google Ads, and SEO systems built to help ambitious businesses grow.'),
('meta_description','Facebook & Instagram campaigns built to reach the right people and support your growth goals.'),
('google_description','Capture high-intent demand when potential customers are actively searching.'),
('seo_description','Strengthen your organic presence with search-focused content and technical improvements.'),
('contact_email','nafisfuad2412@gmail.com'),
('facebook_url','https://www.facebook.com/profile.php?id=61592438321716');
INSERT OR IGNORE INTO cases(slug,category,title,summary,intro,strategy,note,position) VALUES
('personal-brand','Personal Brand Growth','How We Generated 2M+ Impressions','2,074,306 impressions across five identified campaigns.','A professional wanted to reach more people and build a stronger Facebook presence. Five identified campaigns generated 2,074,306 impressions, 20,870 profile and Page visits, 173,037 interactions across two engagement campaigns, and 3,960 follows or likes.','The approach combined reach, video and content engagement, UGC-style creative, profile visits, and campaigns designed to generate follows or likes. The five identified campaigns had approximately $0.25 average CPM. Their summed campaign-level reach was 1,135,363; this is not deduplicated unique reach.','The supplied report includes other clients and does not show its reporting date range. These figures are not presented as three-month or eight-campaign totals.',0),
('curtain-showroom','Luxury Curtain Showroom','How a Curtain Showroom Generated 2,295 Conversations','2,295 messaging conversations across three campaigns.','For a luxury curtain showroom in Bangladesh, three messaging campaigns produced a combined 2,295 messaging conversations from 24 October to 22 November 2026.','The strategy began with broad targeting. Custom audiences were built from people who engaged with the ads, alongside website visitor audiences informed by Meta Pixel tracking. Retargeting ad sets reconnected with interested people and invited them to start a conversation.','The result combines three campaigns. It does not mean every conversation came from retargeting or resulted in a sale.',1),
('website-services','Website Services','How We Generated 36 Conversations & 19 Leads','36 conversations and 19 lead form submissions.','A website services business used several conversion paths to generate 36 messaging conversations and 19 lead form submissions during 24 October–22 November 2026.','The campaign introduced the service, helped interested visitors understand the offer, and offered actions including messages, lead forms, and website actions. Retargeting helped reconnect with people who had already shown interest.','The report also shows six website results labelled /services. Their event definition needs confirmation before describing them as purchases. Results are not claimed as unique people.',2);
