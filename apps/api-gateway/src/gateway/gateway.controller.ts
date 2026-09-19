import { All, Controller, Req, Res, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Request, Response } from "express";
import { Public } from "src/auth/decorator/public.decorator";
import { JwtGuard } from "src/auth/guards/jwt-guard";
import axios, { AxiosError } from 'axios';

@Controller()
@UseGuards(ThrottlerGuard)
export class GatewayController {
    @All('api/auth/register')
    @Public()
    proxyRegister(@Req() req: Request, @Res() res: Response) {
        return this.proxy(req, res, process.env.AUTH_SERVICE_URL!);
    }

    @All('api/auth/login')
    @Public()
    proxyLogin(@Req() req: Request, @Res() res: Response) {
        return this.proxy(req, res, process.env.AUTH_SERVICE_URL!);
    }

    // all other auth routes require a valid token
    @All('api/auth/*')
    @UseGuards(JwtGuard)
    proxyAuth(@Req() req: Request, @Res() res: Response) {
        return this.proxy(req, res, process.env.AUTH_SERVICE_URL!);
    }

    // all profile routes require a valid token
    @All('api/profile/*')
    @UseGuards(JwtGuard)
    proxyProfile(@Req() req: Request, @Res() res: Response) {
        return this.proxy(req, res, process.env.PROFILE_SERVICE_URL!);
    }



    // proxy method
    // private async proxy(req: Request, res: Response, targetUrl: string) {
    //     try {
    //         const url = `${targetUrl}${req.originalUrl}`;
    //         const response = await axios({
    //             method: req.method,
    //             url,
    //             data: req.body as unknown,
    //             headers: {
    //                 ...req.headers,
    //                 host: undefined,
    //             }
    //         })
    //         res.status(response.status).json(response.data);
    //     } catch (err) {
    //         const axiosError = err as AxiosError;
    //         const status = axiosError.response?.status || 500;
    //         const data = axiosError.response?.data || { message: 'Internal Gateway Server Error' };
    //         res.status(status).json(data);
    //     }
    // }

    // private async proxy(req: Request, res: Response, serviceUrl: string) {
    //     try {
    //         const url = `${serviceUrl}${req.originalUrl}`;
    //         const response = await axios({
    //             method: req.method,
    //             url,
    //             data: req.body as unknown,
    //             headers: {
    //                 ...req.headers,
    //                 host: undefined, // strip host header to avoid conflicts with downstream services
    //             },
    //         });
    //         res.status(response.status).json(response.data);
    //     } catch (err: any) {
    //         const axiosError = err as AxiosError<{ message: string }>;
    //         const status = axiosError.response?.status ?? 500;
    //         const data = axiosError.response?.data ?? { message: 'Gateway error' };
    //         res.status(status).json(data);
    //     }
    // }

    private async proxy(
        req: Request,
        res: Response,
        serviceUrl: string,
    ) {
        try {
            const url = `${serviceUrl}${req.originalUrl}`;

            console.log('Proxy URL:', url);
            console.log('Method:', req.method);
            console.log('Body:', req.body);

            const response = await axios({
                method: req.method,
                url,
                data: req.body,
                headers: {
                    'Content-Type': req.headers['content-type'] ?? 'application/json',
                    Authorization: req.headers.authorization,
                },
            });

            return res.status(response.status).json(response.data);

        } catch (err) {
            const axiosError = err as AxiosError;

            console.error('Gateway proxy error:', axiosError.message);

            if (axiosError.response) {
                console.error('Status:', axiosError.response.status);
                console.error('Data:', axiosError.response.data);

                return res
                    .status(axiosError.response.status)
                    .json(axiosError.response.data);
            }

            return res.status(500).json({
                message: 'Gateway error',
            });
        }
    }



}