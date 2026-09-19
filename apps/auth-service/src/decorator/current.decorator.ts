import { createParamDecorator, ExecutionContext } from "@nestjs/common"
import { Request } from "express"

export interface AuththenticatedUser {
    sub: string
    email: string
    lat: number
    exp: number
}

export interface RequestWithUser extends Request {
    user: AuththenticatedUser
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>()
    return req.user;
})