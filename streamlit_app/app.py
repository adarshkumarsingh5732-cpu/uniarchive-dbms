import streamlit as st
from streamlit.components.v1 import iframe

LIVE_URL = "https://uniarchive-dbms.vercel.app/"

st.set_page_config(
    page_title="UniArchive — Live Demo",
    page_icon="🎓",
    layout="wide",
)

st.title("🎓 UniArchive — course-resource sharing platform")
st.caption(
    "React + Express + MySQL app, live-hosted on Vercel. "
    "The full app is embedded below — sign in with the demo account **admin123 / scse**."
)

iframe(LIVE_URL, height=900, scrolling=True)

st.markdown(f"Embed not loading? Open [the live site]({LIVE_URL}) directly.")
