export function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
export function estimateTokensFromJSON(data) {
    const json = JSON.stringify(data);
    return estimateTokens(json);
}
export function formatTokenCount(tokens) {
    if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
}
//# sourceMappingURL=tokenEstimator.js.map