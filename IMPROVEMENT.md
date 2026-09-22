feat: Improve response classification prompt for better accuracy in non-English languages

This commit enhances the heuristic response classification by introducing language-specific prompt templates. Previously, classification relied on a single prompt, which performed sub-optimally for non-English responses.

The changes in `src/lib/analysis.ts` now dynamically adapt the classification prompt based on the detected language of the LLM's output. This ensures more accurate identification of refusal, compliance, hedging, and other response characteristics across the supported 11 languages.

This improvement aims to increase the reliability and effectiveness of RedPincer's analysis capabilities for a global user base.