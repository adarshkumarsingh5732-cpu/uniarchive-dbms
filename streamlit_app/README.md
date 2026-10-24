# streamlit_app

A Streamlit wrapper that embeds the live UniArchive site
(https://uniarchive-dbms.vercel.app) full-screen. Streamlit Community Cloud can
only host Python apps, so the React/Express/MySQL stack itself stays on Vercel —
this page is the "host on Streamlit" entry point.

## Run locally

```bash
pip install -r streamlit_app/requirements.txt
streamlit run streamlit_app/app.py
```

## Deploy on Streamlit Community Cloud

1. Go to https://share.streamlit.io and sign in with GitHub
   (adarshkumarsingh5732-cpu).
2. **New app** → repo `adarshkumarsingh5732-cpu/uniarchive-dbms`, branch `main`,
   main file path: `streamlit_app/app.py`.
3. Deploy. Requirements come from `streamlit_app/requirements.txt`.
