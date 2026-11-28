package app.assistant;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class OpenAiRealtimeSessionProviderTest {
    @Test void sendsServerSideMultipartConfigurationAndReturnsOnlySdp() throws Exception {
        var body=new AtomicReference<String>();
        var auth=new AtomicReference<String>();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/v1/realtime/calls",exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] answer="v=0\r\nfake-answer".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type","application/sdp");
            exchange.sendResponseHeaders(201,answer.length);
            exchange.getResponseBody().write(answer); exchange.close();
        });
        server.start();
        try {
            var provider=new OpenAiRealtimeSessionProvider("http://127.0.0.1:"+server.getAddress().getPort()+"/v1",
                    "server-only-test-key",true,"configured-model","cedar");
            String answer=provider.answer("v=0\r\noffer",JsonMapper.builder().build().readTree("{\"type\":\"realtime\",\"model\":\"configured-model\"}"));
            assertEquals("v=0\r\nfake-answer",answer);
            assertEquals("Bearer server-only-test-key",auth.get());
            assertTrue(body.get().contains("name=\"sdp\""));
            assertTrue(body.get().contains("name=\"session\""));
            assertTrue(body.get().contains("configured-model"));
            assertFalse(answer.contains("server-only-test-key"));
        } finally { server.stop(0); }
    }

    @Test void providerErrorsDoNotExposeUpstreamAccountOrCredentialDetails() throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/realtime/calls",exchange -> {
            byte[] answer="sensitive upstream account details".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(401,answer.length);
            exchange.getResponseBody().write(answer); exchange.close();
        });
        server.start();
        try {
            var provider=new OpenAiRealtimeSessionProvider("http://127.0.0.1:"+server.getAddress().getPort(),"test",true,"model","cedar");
            var error=assertThrows(AssistantException.class,()->provider.answer("v=0",JsonMapper.builder().build().createObjectNode()));
            assertEquals("ASSISTANT_UPSTREAM_ERROR",error.getCode());
            assertFalse(error.getMessage().contains("sensitive"));
        } finally { server.stop(0); }
    }

    @Test void missingKeyOrDisabledFeatureDoesNotOpenAProviderConnection() {
        var config=JsonMapper.builder().build().createObjectNode();
        for (var provider:java.util.List.of(
                new OpenAiRealtimeSessionProvider("http://127.0.0.1:9","",true,"model","cedar"),
                new OpenAiRealtimeSessionProvider("http://127.0.0.1:9","test",false,"model","cedar"))) {
            assertFalse(provider.available());
            assertEquals("ASSISTANT_UNAVAILABLE",assertThrows(AssistantException.class,()->provider.answer("v=0",config)).getCode());
        }
    }
}
