import google.generativeai as genai
import os
import requests
from app.config import settings

# Configure Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.0-flash")


def generate_fallback_with_groq(prompt: str) -> str:
    """
    Call Groq API as a fallback when Gemini is rate limited / quota exceeded.
    """
    from dotenv import load_dotenv
    load_dotenv()
    
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return "Failed to generate response: API quota exceeded."

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3
    }
    try:
        response = requests.post(url, json=data, headers=headers, timeout=30)
        if response.status_code == 200:
            res_json = response.json()
            return res_json["choices"][0]["message"]["content"]
        else:
            print(f"Groq API error: {response.status_code} - {response.text}")
            return "Failed to generate response: API quota exceeded."
    except Exception as e:
        print(f"Groq fallback exception: {e}")
        return "Failed to generate response: API quota exceeded."


def generate_answer(context: str, question: str):

    prompt = f"""
You are an AI Student Notes Assistant, designed to behave like ChatGPT with a highly structured, professional, and helpful tone.

RULES:
1. Rely ONLY on the provided notes context below. Do NOT assume, extrapolate, or bring in any outside knowledge or external information.
2. If the user asks for the "most important topics", analyze the provided notes context and extract the key concepts, themes, and terms. Present them in a beautifully structured, comprehensive summary with headings and bullet points.
3. If the answer to the question cannot be found in the provided notes, reply exactly with: "I couldn't find this information in the uploaded notes." Do NOT make up facts.
4. Format all responses beautifully in Markdown using clear headings, bold terms, and structured bullet lists to create an outstanding reading experience.

Notes Context:
{context}

Question:
{question}
"""
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Gemini error in generate_answer: {e}. Trying Groq fallback...")
        return generate_fallback_with_groq(prompt)



def generate_summary(text: str) -> str:
    """
    Summarize lecture notes text using Gemini.
    """
    truncated_text = text[:20000]
    prompt = f"""
You are an AI Student Notes Assistant.
Please analyze the following lecture notes and generate a comprehensive, structured study summary.

Include:
1. **Core Subject & Overview**: What is the overall topic of these notes?
2. **Key Concepts & Definitions**: Explain the main terms, principles, or formulas.
3. **Detailed Breakdown**: Bullet points of sections/chapters/key themes.
4. **Summary & Takeaways**: A brief wrap-up of what students should focus on.

Keep the tone professional, helpful, and clear for a student. Use neat Markdown formatting.

Lecture Notes:
{truncated_text}
"""
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Gemini error in generate_summary: {e}. Trying Groq fallback...")
        summary = generate_fallback_with_groq(prompt)
        if summary.startswith("Failed to generate response"):
            return "Failed to generate AI summary for this document."
        return summary