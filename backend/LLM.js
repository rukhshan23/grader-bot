import axios from "axios";
export async function generate(model, system, query, temperature = 0.2, lastk = 0, session_id = "test", rag_threshold = 0.5, rag_usage = false, rag_k = 0) {
    const headers = {
        "x-api-key": process.env.apiKey,
        "request_type":"call"
    };
  
    const end_point = process.env.endPoint
  
    const requestBody = {
        model: model,
        system: system,
        query: query,
        temperature: temperature,
        lastk: lastk,
        session_id: session_id,
        rag_threshold: rag_threshold,
        rag_usage: rag_usage,
        rag_k: rag_k
    };
  
    try {
        const response = await axios.post(end_point, requestBody, { headers });
        if (response.status === 200) {
            const res = response.data;
            return { response: res.result, rag_context: res.rag_context };
        } else {
            return `Error: Received response code ${response.status}`;
        }
    } catch (error) {
        return `An error occurred: ${error.message}`;
    }
  }
