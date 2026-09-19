import { IsEmail, IsString } from "class-validator"

export class LoginRegisterDto {
    @IsEmail()
    email!: string

    @IsString()
    password!: string
}