export default async function handler(req, res) {
    // Allow only POST
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const API_KEY = process.env.GROQ_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: "API key not configured on server." });
    }

    try {
        const { owner, repo } = req.body;

        if (!owner || !repo) {
            return res.status(400).json({ error: "owner and repo are required." });
        }

        const prompt = `
You are a senior software engineer.

Review the GitHub repository:

Owner: ${owner}
Repository: ${repo}

Provide the following:

Overall Score (0-100)

Star Rating (1-5)

Strengths

Weaknesses

Possible Bugs

Security Issues

Performance Improvements

Code Quality

Best Practices

Optimization Suggestions

Return the answer in clear markdown.
`;

        const groqResponse = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${API_KEY}`,
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.4,
                }),
            }
        );

        if (!groqResponse.ok) {
            const errText = await groqResponse.text();
            console.error("Groq error:", errText);
            return res.status(groqResponse.status).json({ error: "AI review failed." });
        }

        const data = await groqResponse.json();
        const review = data.choices[0].message.content;

        return res.status(200).json({ review });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal server error." });
    }
}
