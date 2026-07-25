export default async function handler(req, res) {
    // Allow only POST
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const API_KEY = process.env.API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: "API key not configured on server." });
    }

    try {
        const { owner, repo } = req.body;

        if (!owner || !repo) {
            return res.status(400).json({ error: "owner and repo are required." });
        }

        // --- Step 1: Fetch real repo metadata from GitHub ---
        const githubHeaders = { "User-Agent": "AI-Code-Review-Dashboard" };

        const [repoRes, langRes, treeRes] = await Promise.all([
            fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: githubHeaders }),
            fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers: githubHeaders }),
            fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers: githubHeaders }),
        ]);

        // Parse responses (best-effort; don't fail if one fails)
        let repoData = {};
        let languages = {};
        let fileList = [];

        if (repoRes.ok) repoData = await repoRes.json();
        if (langRes.ok) languages = await langRes.json();
        if (treeRes.ok) {
            const treeData = await treeRes.json();
            fileList = (treeData.tree || [])
                .filter(f => f.type === "blob")
                .map(f => f.path)
                .slice(0, 60); // limit to 60 files to keep prompt short
        }

        // Build human-readable context strings
        const langList = Object.keys(languages).join(", ") || "Unknown";
        const fileListStr = fileList.length
            ? fileList.join("\n")
            : "File list unavailable";
        const description = repoData.description || "No description provided";
        const primaryLang = repoData.language || langList;

        // --- Step 2: Build a context-aware prompt ---
        const prompt = `
You are a senior software engineer performing a code review.

Here is the real metadata for the GitHub repository you are reviewing:

Repository: ${owner}/${repo}
Description: ${description}
Primary Language: ${primaryLang}
All Languages Used: ${langList}

Actual files in this repository:
${fileListStr}

Based ONLY on the above real information (the actual languages and files listed above),
provide a structured code review. Do NOT invent file names or languages that are not listed above.
Only reference files and technologies that are actually present.

Provide the following sections:

1. Overall Score (0-100)
2. Star Rating (1-5 stars)
3. Strengths
4. Weaknesses
5. Possible Bugs (reference actual files listed above)
6. Security Issues
7. Performance Improvements
8. Code Quality
9. Best Practices
10. Optimization Suggestions

Return the answer in clear markdown format.
`;

        // --- Step 3: Call Groq AI with the context-aware prompt ---
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
