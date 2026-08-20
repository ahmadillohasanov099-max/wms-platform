import { JwtService } from '@nestjs/jwt';

export async function generateTokens(
  jwtService: JwtService,
  userId: string,
  username: string,
  role: string,
) {
  const payload = { sub: userId, username, role };

  const [accessToken, refreshToken] = await Promise.all([
    jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET as string,
      expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
    }),
    jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET as string,
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as any,
    }),
  ]);

  return { accessToken, refreshToken };
}
