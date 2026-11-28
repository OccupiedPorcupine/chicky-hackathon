package app.assistant;

import tools.jackson.databind.JsonNode;

/** Server-side SDP exchange; the browser never receives the project API key. */
public interface RealtimeSessionProvider {
    boolean available();
    String model();
    String voice();
    String answer(String sdp, JsonNode session);
}
