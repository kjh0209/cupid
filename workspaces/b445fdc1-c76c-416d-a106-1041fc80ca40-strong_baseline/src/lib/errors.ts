// Duplicated error response helpers - good refactor target

export function badRequest(message: string) {
  return { error: message, status: 400 };
}

export function notFound(message: string) {
  return { error: message, status: 404 };
}

export function serverError(message: string) {
  return { error: message, status: 500 };
}

export function unauthorized() {
  return { error: "Unauthorized", status: 401 };
}
