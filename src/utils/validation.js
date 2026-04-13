const { z } = require("zod");

/**
 * Esquemas de validación usando Zod para endpoints de autenticación
 * 
 * Ventajas sobre express-validator:
 * - Validación más estricta y type-safe
 * - Mejor manejo de errores
 * - Composición de esquemas más clara
 */

/**
 * Schema para el endpoint de LOGIN
 * 
 * Validaciones:
 * - email: debe ser un email válido
 * - password: mínimo 8 caracteres, máximo 128
 */
const loginSchema = z.object({
  email: z
    .string()
    .email("El email debe ser válido")
    .toLowerCase()
    .trim(),
  
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña no puede exceder 128 caracteres"),
});

/**
 * Schema para el endpoint de REGISTRO
 * 
 * Validaciones:
 * - email: debe ser un email válido, único en la BD
 * - password: mínimo 8 caracteres, máximo 128
 *   * Debe contener: mayúscula, minúscula, número, carácter especial
 * - nombre: opcional, mínimo 2 caracteres, máximo 100
 */
const registerSchema = z.object({
  email: z
    .string()
    .email("El email debe ser válido")
    .toLowerCase()
    .trim(),
  
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña no puede exceder 128 caracteres")
    .regex(
      /[A-Z]/,
      "La contraseña debe contener al menos una mayúscula"
    )
    .regex(
      /[a-z]/,
      "La contraseña debe contener al menos una minúscula"
    )
    .regex(
      /[0-9]/,
      "La contraseña debe contener al menos un número"
    )
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      "La contraseña debe contener al menos un carácter especial"
    ),
  
  nombre: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres")
    .trim()
    .optional()
    .default(""),
  
  avatar_style: z
    .string()
    .optional()
    .default('avataaars')
    .refine(val => ['avataaars', 'bottts', 'lorelei', 'pixel-art', 'thumbs', 'notionists', 'notionists-neutral', 'dylan', 'croodles', 'personas'].includes(val), "Estilo de avatar inválido"),
});

/**

 * Función auxiliar para validar datos contra un schema
 * @param {Object} schema - Schema de Zod
 * @param {Object} data - Datos a validar
 * @returns {Object} { success: boolean, data?: Object, errors?: Object }
 */
function validateData(schema, data) {
  try {
    const validated = schema.parse(data);
    return {
      success: true,
      data: validated,
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errors = err.errors.reduce((acc, error) => {
        const field = error.path.join(".");
        acc[field] = error.message;
        return acc;
      }, {});

      return {
        success: false,
        errors,
      };
    }

    throw err;
  }
}

/**
 * Middleware para validar datos con Zod
 * @param {Object} schema - Schema de Zod
 * @returns {Function} Middleware express
 */
function validateRequest(schema) {
  return (req, res, next) => {
    const result = validateData(schema, req.body);

    if (!result.success) {
      // Construir mensaje con primer error para el frontend
      const firstErrorField = Object.keys(result.errors)[0];
      const firstErrorMessage = result.errors[firstErrorField];
      
      return res.status(400).json({
        error: "Validación fallida",
        message: firstErrorMessage,
      });
    }

    // Reemplazar req.body con los datos validados
    req.body = result.data;
    next();
  };
}

module.exports = {
  // Schemas
  loginSchema,
  registerSchema,

  // Utilidades
  validateData,
  validateRequest,
};
