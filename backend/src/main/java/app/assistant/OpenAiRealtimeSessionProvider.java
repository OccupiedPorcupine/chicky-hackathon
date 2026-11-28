package app.assistant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;

import java.time.Duration;

/** OpenAI's unified Realtime WebRTC calls interface, not the separate GPT-Live API. */
@Component
public class OpenAiRealtimeSessionProvider implements RealtimeSessionProvider {
    private final RestClient client;
    private final boolean available;
    private final String model;
    private final String voice;

    public OpenAiRealtimeSessionProvider(
            @Value("${app.assistant.openai.base-url:https://api.openai.com/v1}") String baseUrl,
            @Value("${app.assistant.openai.api-key:}") String apiKey,
            @Value("${app.assistant.realtime.enabled:true}") boolean enabled,
            @Value("${app.assistant.realtime.model:gpt-realtime-2.1}") String model,
            @Value("${app.assistant.realtime.voice:cedar}") String voice) {
        this.available = enabled && apiKey != null && !apiKey.isBlank();
        this.model = model;
        this.voice = voice;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(30));
        client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey).build();
    }

    @Override public boolean available() { return available; }
    @Override public String model() { return model; }
    @Override public String voice() { return voice; }

    @Override
    public String answer(String sdp, JsonNode session) {
        if (!available) throw AssistantException.unavailable("Live voice is not configured on this server.");
        var form = new LinkedMultiValueMap<String, Object>();
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        form.add("sdp", sdp);
        form.add("session", new HttpEntity<>(session.toString(), headers));
        try {
            String answer = client.post().uri("/realtime/calls")
                    .contentType(MediaType.MULTIPART_FORM_DATA).body(form).retrieve().body(String.class);
            if (answer == null || !answer.startsWith("v=0") || answer.length() > 65536) {
                throw AssistantException.upstream("The live voice service returned an invalid connection answer.");
            }
            return answer;
        } catch (RestClientException exception) {
            // Upstream bodies may contain account details; never pass them to the browser or logs.
            throw AssistantException.upstream("Live voice could not connect. Please try again or use the recorded assistant.");
        }
    }
}
