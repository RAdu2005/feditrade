process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:1234@localhost:5432/market?schema=public";
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "test_secret_test_secret_test_secret_1234";
process.env.APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";
process.env.AP_INSTANCE_DOMAIN = process.env.AP_INSTANCE_DOMAIN ?? "localhost:3000";
process.env.AP_LISTINGS_ACTOR = process.env.AP_LISTINGS_ACTOR ?? "listings";
process.env.AP_PRIVATE_KEY_PEM =
  process.env.AP_PRIVATE_KEY_PEM ??
  "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDEv4fYOFzZa1Fw\\nNqwjQEXYMA3hmgQxLG1pLAxnMqQcJ5I0naQSljOCUwxHG/iXV5quxga8R3XynE3n\\nPiUaf/6f9NmnABPeJKg4Xf6lK7R1Mp95p1gD4AkAqC2n4vkTw6f5erkgPJUjYQrj\\n4y3hT+tS6f/LxzkY6CMh+H7wpRfaRlFMB+2hmsP4fA5d4OGfVG9q22MqQ6jW3Twq\\nqNKG6ozGF2MoAFRix9kQdbAjAF9HwVoo2AmdjPz2um8ow0e0OW57fR6Rz9K5Ne76\\n7v72fB63I6VJfxn6QqK2+Qud8TaA6iv6dUS8MOBQdeFlHTkKwDfr8fGL4YbcMMe0\\nNj1wob29AgMBAAECggEAGznk61Gx6vR6Tqd1xJ8M7LcbY+jVnM8H68VfJ+W+Rk9a\\nUN6tw9QGLI0fWQv4sa2T0Q6d8QzbfBf9IvJkA8V1h8qV8mQ9OnA6P0y6Q83EAXeM\\nM6p6HBPEscvNpR0vvfRkH3b8w43P+XpoT1fWIGK8xq4LkkY84qfZpQ4M9j6Klfya\\nBr2zuW2VkfI7eV2M1+U6K4a0F3MhpnT0zqslkArVZfXPEMQ42S0I7jM6bMPDLe1e\\n8JO7qAYao6HfS34mSm+e1DwkWGv5OCIvWQbM0x+4sPoQ2wzBaJq0JvG8JmHzAN8K\\nYel1N4e7g4geGB+6B7C9I4f+r5N8YxPY6E9nM8VfEQKBgQDtRdxzY2WCSvPKM+4V\\nV9mJcM9EdgNycY2n8R8G8mNh6vFy3p6s8G4f5EG0u8CfG6wWUaUk8rsh6xg5B2mF\\nqAuhCJWVwux+cxzeF58hK6iZVgS/YE0U1Hn7k6xM9veBR2nWqf3r+tnX3l2qv5bo\\nSf9pD1x3k6Sg5mB8el+fHfWJ6QKBgQDUh+EL0eXwXUGIv7vBjUfwGxqYaxkFxDMU\\n1xB8j7gR6D8SndHj35nygk0z0zW4V8Qy3l3w7xN9lhtzHh9Y8GwGbc4YkByvFh6H\\nPuj8H8CEB9mFQkYVK6kA2lK8bIw1IjtJKv+0J5k1f3Y1K9l2Z8u0d2T7y2x0Xh4g\\n2/ju7k0g7QKBgQCG+E3TtDOUP5YhNUWrQ5qfJ9nHhT3k4G3x2Kz3fE1mQ4udOL8L\\n6EGT3Kq0xSpk0mYj2M4J44M+HfLwPCm6sE5uM6A0JY6NB2NQfJQ4I8F7S3oQ2j4g\\nY1Q5k4g4v8POxYpP2WkIms9u4m8w5y1X7p0wWwzXrN0mVqk2I7d5J0jC5QKBgF9S\\n+PQ02b4E4B6ukXvI8Y6gGs0eQm1y2N+6s6zwn8Ipn5Wf4T0Qdln7Vj5pH3Kx4Wf6\\nB6k8m6WJw4v2wQ9QwG9c0SZUP1vX+4g8R8HQBS0F9s8vj7Qrf8yTRWkGoTNoT9GQ\\nWfDg5yKRjY4z9YQJg0mK8dy8Qfxt7u42qJ8z0zshAoGBAJY2+o5hI4OQ8k8ZJpX1\\n2HT8mUynWQh4Le5xYfJXj5Y8Ah6d0mG1+N0l0mQh4V+fN5H4G6Q6xT5kI4a1xUf8\\nO8lF2N8m6Ww7G8h6D1y6o3mN8x9oJ8b1gL7Qf1k5l8r8J8xY0t4Y4gk1gH8F2v5M\\nCjDYh7B2V3LrO0c6w2+Ykz8M\\n-----END PRIVATE KEY-----\\n";
process.env.AP_PUBLIC_KEY_PEM =
  process.env.AP_PUBLIC_KEY_PEM ??
  "-----BEGIN PUBLIC KEY-----\\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyDmAnOv7tyfRllBf95NC\\n3t0hJOEdDszcMC0WY351D4Y9qHxhg88fgT/MNLZBXlTymCVCWhSABoglv5WAt8yf\\nIugls3sCUt9UosAczXN4YWNQ227nWE/Mqkf0N5QyvspU4UT4Anza8EcKkC2XQ4Ob\\nyVAwDGcrKqLj9eCS/5rjPKR4MwtJO4yRX+xD7FDWKOXioT0IBD4uLTqvORcE8Agx\\nMPfiAYlzQ7WkzIgqDulPs1iPEarA74XKtDZgyqNrmZRxNEQsvKsnuqzvd6KS/XPU\\nPh1/abIcXFZIG/JurlPkSPDIzNuow9oeKiCXtCCENyVeQLH2Hxq9Nl4lypU62xIx\\nzQIDAQAB\\n-----END PUBLIC KEY-----\\n";
process.env.AP_FEDERATION_TARGETS = process.env.AP_FEDERATION_TARGETS ?? "";
process.env.ADMIN_ACTOR_URIS = process.env.ADMIN_ACTOR_URIS ?? "";
process.env.S3_REGION = process.env.S3_REGION ?? "us-east-1";
process.env.S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9000";
process.env.S3_BUCKET = process.env.S3_BUCKET ?? "market-listings";
process.env.S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID ?? "minioadmin";
process.env.S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin";
process.env.S3_PUBLIC_BASE_URL =
  process.env.S3_PUBLIC_BASE_URL ?? "http://localhost:9000/market-listings";
process.env.ALLOW_LOCAL_UPLOAD_FALLBACK = process.env.ALLOW_LOCAL_UPLOAD_FALLBACK ?? "false";
