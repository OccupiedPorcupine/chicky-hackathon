package app.assistant;

// Who the voice assistant is (issue #16): Uncle, a friendly hawker uncle. Chicky stays the
// name of the app. His name isn't final (#3), so it lives here and everything that says it
// (the prompt, the Telegram copy) reads it from this constant.
public final class AssistantPersona {

    public static final String NAME = "Uncle";

    private AssistantPersona() {
    }
}
