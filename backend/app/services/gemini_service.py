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
1. GREETINGS & SMALL TALK: If the user is greeting you (e.g., 'hi', 'hello', 'hey', 'how are you') or making general conversation, respond in a warm, welcoming, and friendly manner. Introduce yourself as their Study Assistant and offer to help them analyze or study their notes. Do NOT search the notes context or give the fallback message for greetings.
2. QUESTION ANSWERING: If the user asks a question about the notes or subject matter, rely ONLY on the provided notes context below. Do NOT use outside knowledge or external facts.
3. FALLBACK: If the question is about the notes/subject and the answer cannot be found in the provided notes context, reply exactly with: "I couldn't find this information in the uploaded notes." Do NOT make up or assume facts.
4. FORMATTING: Present all information in a beautifully structured, comprehensive format using clear Markdown headings, bold keywords, and neat bullet lists (similar to ChatGPT) to make it highly readable.

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