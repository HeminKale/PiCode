package com.flowos;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import javax.tools.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Not a hardened sandbox: the Runtime.getRuntime/ProcessBuilder literal-string checks below are
 * a basic guardrail, not real isolation. Compiled classes still run in-process with full JVM
 * permissions, just under a bounded-time executor.
 *
 * Execute convention: the target method must take a single java.util.Map<String,Object> parameter
 * (the resolved inputVars, keyed by name) and return an Object, OR take no parameters at all.
 * Reflection tries the Map-arg overload first, falls back to no-arg.
 */
@RestController
public class RuntimeController {
  private record LoadedClass(Class<?> clazz, URLClassLoader loader, Object instance) {}

  private final Map<String, LoadedClass> classes = new ConcurrentHashMap<>();
  private final ExecutorService executor = Executors.newCachedThreadPool();

  @PostMapping("/classes")
  public ResponseEntity<Map<String, Object>> compile(@RequestBody Map<String, String> body) {
    String name = body.get("className"), source = body.get("sourceCode");
    if (name == null || source == null || source.length() > 50000
        || source.contains("Runtime.getRuntime") || source.contains("ProcessBuilder")) {
      return ResponseEntity.badRequest().body(Map.of("error", "Unsafe or invalid source"));
    }

    JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
    if (compiler == null) throw new IllegalStateException("A JDK is required, not a JRE");

    try {
      Path workDir = Files.createTempDirectory("flowos-java-" + name + "-");
      Path sourceFile = workDir.resolve(name + ".java");
      Files.writeString(sourceFile, source);

      DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
      StandardJavaFileManager fileManager = compiler.getStandardFileManager(diagnostics, null, null);
      fileManager.setLocation(StandardLocation.CLASS_OUTPUT, List.of(workDir.toFile()));
      Iterable<? extends JavaFileObject> units = fileManager.getJavaFileObjectsFromFiles(List.of(sourceFile.toFile()));

      JavaCompiler.CompilationTask task = compiler.getTask(null, fileManager, diagnostics, null, null, units);
      boolean success = task.call();
      fileManager.close();

      if (!success) {
        List<String> errors = diagnostics.getDiagnostics().stream().map(Object::toString).toList();
        return ResponseEntity.badRequest().body(Map.of("error", "Compilation failed", "diagnostics", errors));
      }

      URLClassLoader loader = new URLClassLoader(new URL[] { workDir.toUri().toURL() }, RuntimeController.class.getClassLoader());
      Class<?> clazz = Class.forName(name, true, loader);
      Object instance = clazz.getDeclaredConstructor().newInstance();

      LoadedClass previous = classes.put(name, new LoadedClass(clazz, loader, instance));
      if (previous != null) previous.loader().close();

      return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("className", name, "loaded", true));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(Map.of("error", "Compilation failed: " + e.getMessage()));
    }
  }

  @PostMapping("/classes/{className}/execute")
  public ResponseEntity<Map<String, Object>> execute(@PathVariable String className, @RequestBody(required = false) Map<String, Object> body) {
    LoadedClass loaded = classes.get(className);
    if (loaded == null) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Class is not loaded"));
    }

    String method = body == null ? null : (String) body.get("method");
    if (method == null) {
      return ResponseEntity.badRequest().body(Map.of("error", "method is required"));
    }
    @SuppressWarnings("unchecked")
    Map<String, Object> input = body.get("input") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();

    Future<Object> future = executor.submit(() -> {
      try {
        Method target = loaded.clazz().getMethod(method, Map.class);
        return target.invoke(loaded.instance(), input);
      } catch (NoSuchMethodException nsme) {
        Method target = loaded.clazz().getMethod(method);
        return target.invoke(loaded.instance());
      }
    });

    try {
      Object result = future.get(5, TimeUnit.SECONDS);
      return ResponseEntity.ok(Map.of("className", className, "result", result == null ? Map.of() : result));
    } catch (TimeoutException te) {
      future.cancel(true);
      return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).body(Map.of("error", "Execution timed out after 5s"));
    } catch (ExecutionException ee) {
      Throwable cause = ee.getCause();
      if (cause instanceof InvocationTargetException ite && ite.getCause() != null) cause = ite.getCause();
      return ResponseEntity.badRequest().body(Map.of("error", "Execution failed: " + (cause == null ? ee.getMessage() : cause.getMessage())));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", String.valueOf(e.getMessage())));
    }
  }
}
