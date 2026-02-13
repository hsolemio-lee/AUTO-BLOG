const required = ["NEXT_PUBLIC_SITE_URL", "VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"];
const optional = [
  "NEXT_PUBLIC_ADSENSE_CLIENT",
  "NEXT_PUBLIC_ADSENSE_HOME_SLOT",
  "NEXT_PUBLIC_ADSENSE_POST_TOP_SLOT",
  "NEXT_PUBLIC_ADSENSE_POST_BOTTOM_SLOT",
  "NEXT_PUBLIC_CONTACT_EMAIL"
];

let failed = false;

for (const key of required) {
  if (!process.env[key]) {
    failed = true;
    console.error(`Missing required variable: ${key}`);
  } else {
    console.log(`OK required variable: ${key}`);
  }
}

for (const key of optional) {
  if (!process.env[key]) {
    console.warn(`Optional variable not set: ${key}`);
  } else {
    console.log(`OK optional variable: ${key}`);
  }
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (siteUrl && !/^https:\/\//.test(siteUrl)) {
  failed = true;
  console.error("NEXT_PUBLIC_SITE_URL must start with https://");
}

if (failed) {
  process.exitCode = 1;
}
