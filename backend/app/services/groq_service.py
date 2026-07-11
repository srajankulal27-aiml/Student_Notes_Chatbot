import os
import requests
from fastapi import HTTPException, status

# -----------------------------
# Configuration & Client Options
# -----------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


def call_groq_completions(messages: list[dict], temperature: float = 0.3, max_tokens: int = 2048) -> str:
    """
    Why it is written:
        To encapsulate the raw HTTP connection to the Groq completions endpoint, keeping API calls DRY.

    What it does:
        Makes a POST request to Groq API with the provided messages and parameters.
        Returns the generated content text, or raises an HTTP 500 error if it fails.

    Inputs:
        messages: list[dict] - The list of role/content dictionaries representing conversation history/prompts.
        temperature: float - Creativity/determinism setting.
        max_tokens: int - Response token limit.

    Outputs:
        str - The response text from Groq.
    """
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Groq API key not configured in environment variables."
        )

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    models_to_try = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-8b-8192"]
    last_error = None

    for model in models_to_try:
        data = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        try:
            response = requests.post(GROQ_API_URL, json=data, headers=headers, timeout=30)
            if response.status_code == 200:
                res_json = response.json()
                return res_json["choices"][0]["message"]["content"]
            elif response.status_code == 429:
                print(f"Rate limited on model {model}. Trying fallback...")
                last_error = f"Rate limited (429): {response.text}"
                continue
            else:
                print(f"Groq API error for model {model}: {response.status_code} - {response.text}")
                last_error = f"API error: {response.status_code} - {response.text}"
        except Exception as e:
            print(f"Exception during Groq API call for model {model}: {e}")
            last_error = str(e)

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Failed to reach Groq services after trying fallback models. Last error: {last_error}"
    )


def generate_answer(context: str, question: str, history: list[dict] = None, filename: str = "Notes") -> str:
    """
    Why it is written:
        To construct the RAG prompt template and generate a student notes assistant response using Groq.

    What it does:
        Defines the rules for the chatbot:
        1. GREETINGS & SMALL TALK: If the user is greeting you (e.g., 'hi', 'hello', 'hii', 'hey') and this is the start of the conversation (no history), respond with a simple, warm greeting: "Hello! I am your AI Student Notes Assistant. How can I help you today with your notes?" Do NOT include any 'Introduction' headers or long list of sections. If the conversation has already started (history exists), simply respond to their greeting or follow-up politely and briefly without repeating introductions.
        2. QUESTION ANSWERING: For any informational or notes-related question, you must base your entire response on the "Notes Context" text blocks.
        3. STRICT FALLBACK: If the answer cannot be directly found in the "Notes Context", you must output: "I couldn't find this information in the uploaded notes."
        4. FORMATTING: Present all information in a beautifully structured, comprehensive format using clear Markdown headings, bold keywords, and neat bullet lists to make it highly readable.

    Inputs:
        context: str - The text chunks parsed from search similarity results.
        question: str - The question query.
        history: list[dict] - Optional previous chat history list of {"role": str, "content": str}.
        filename: str - The name of the notes document.

    Outputs:
        str - The formatted response text from Llama-3.3 on Groq.
    """
    system_prompt = f"""
You are an AI Student Notes Assistant, designed to behave like ChatGPT with a highly structured, professional, and friendly tone.

The user is studying their notes: "{filename}".

CRITICAL RULE:
You must answer questions relying ONLY and EXCLUSIVELY on the provided "Notes Context" below. 
Do NOT use any outside knowledge, external training facts, web search, or assumptions. 
If the answer is not explicitly written in the "Notes Context" below, you are strictly required to reply exactly with: "I couldn't find this information in the uploaded notes." 
Do NOT try to construct an answer from general knowledge.

RULES:
1. GREETINGS & SMALL TALK: If the user is greeting you (e.g., 'hi', 'hello', 'hii', 'hey') and this is the start of the conversation (no history), respond with a simple, warm greeting: "Hello! I am your AI Student Notes Assistant. How can I help you today with your notes?" Do NOT include any 'Introduction' headers or long list of sections. If the conversation has already started (history exists), simply respond to their greeting or follow-up politely and briefly without repeating introductions.
2. QUESTION ANSWERING: For any informational or notes-related question, you must base your entire response on the "Notes Context" text blocks.
3. STRICT FALLBACK: If the answer cannot be directly found in the "Notes Context", you must output: "I couldn't find this information in the uploaded notes."
4. FORMATTING: Present all information in a beautifully structured, comprehensive format using clear Markdown headings, bold keywords, and neat bullet lists to make it highly readable.
5. NO VISUALS OR IMAGES: Do NOT output any images, figures, diagrams, or external image links. Present all information in text/markdown format only. Do not attempt to generate Mermaid diagrams or draw illustrations.

Notes Context:
{context}
"""
    messages = [
        {"role": "system", "content": system_prompt}
    ]

    # Append history if present
    if history:
        for msg in history[-10:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": question})

    return call_groq_completions(messages, temperature=0.1)


def generate_summary(text: str) -> str:
    """
    Why it is written:
        To extract key topics, concepts, and a clean study guide overview from uploaded PDF text using Groq.

    What it does:
        Constructs a summarization prompt, truncates input text to prevent token limit issues,
        and queries Groq to create a structured study summary.

    Inputs:
        text: str - The raw document text contents.

    Outputs:
        str - The formatted study guide summary in Markdown.
    """
    # Truncate text context to prevent exceeding token limit on smaller models
    truncated_text = text[:15000]
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
    messages = [
        {"role": "user", "content": prompt}
    ]
    try:
        return call_groq_completions(messages, temperature=0.2, max_tokens=1500)
    except Exception as e:
        print(f"Groq summary generation failed: {e}")
        return "Failed to generate AI summary for this document."
